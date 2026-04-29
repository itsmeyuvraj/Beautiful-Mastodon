
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());

  const upload = multer({ storage: multer.memoryStorage() });

  // Specialized media proxy to handle multipart/form-data
  app.post('/api/mastodon/v1/media', upload.single('file'), async (req, res) => {
    const token = req.cookies.m_token;
    const instance = req.cookies.m_instance;

    if (!token || !instance) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    try {
      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
      formData.append('file', blob, req.file.originalname);
      
      if (req.body.description) {
        formData.append('description', req.body.description);
      }

      const response = await axios.post(`https://${instance}/api/v1/media`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Mastodon Media error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Media Error' });
    }
  });

  // In-memory store for dynamic app registration
  // In production, you'd use a database.
  const appRegistry: Record<string, { client_id: string; client_secret: string }> = {};

  // Store for state to prevent CSRF (simplified)
  const oauthStates: Record<string, { instance: string }> = {};

  // 1. Get or Create App for Instance
  app.post('/api/auth/register', async (req, res) => {
    const { instance } = req.body; // e.g. "mastodon.social"
    if (!instance) return res.status(400).json({ error: 'Instance required' });

    try {
      if (appRegistry[instance]) {
        return res.json({ client_id: appRegistry[instance].client_id });
      }

      const redirectUri = `${process.env.APP_URL || `http://localhost:${PORT}`}/auth/callback`;
      
      const response = await axios.post(`https://${instance}/api/v1/apps`, {
        client_name: 'Beautiful Mastodon',
        redirect_uris: redirectUri,
        scopes: 'read write follow',
        website: process.env.APP_URL
      });

      appRegistry[instance] = {
        client_id: response.data.client_id,
        client_secret: response.data.client_secret
      };

      res.json({ client_id: response.data.client_id });
    } catch (error: any) {
      console.error('Registration error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to register app on instance' });
    }
  });

  app.post('/api/auth/session', (req, res) => {
    const { token, instance } = req.body;
    if (!token || !instance) return res.status(400).json({ error: 'Missing params' });
    
    // Set cookies with maxAge to ensure they persist
    const cookieOptions = { httpOnly: true, secure: true, sameSite: 'none' as const, maxAge: 30 * 24 * 60 * 60 * 1000 };
    res.cookie('m_token', token, cookieOptions);
    res.cookie('m_instance', instance, { ...cookieOptions, httpOnly: false });
    res.json({ success: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('m_token', { sameSite: 'none', secure: true });
    res.clearCookie('m_instance', { sameSite: 'none', secure: true });
    res.json({ success: true });
  });

  // 2. Generate Auth URL
  app.get('/api/auth/url', (req, res) => {
    const { instance, client_id } = req.query;
    if (!instance || !client_id) return res.status(400).json({ error: 'Missing params' });

    const state = Math.random().toString(36).substring(7);
    oauthStates[state] = { instance: instance as string };

    const redirectUri = `${process.env.APP_URL || `http://localhost:${PORT}`}/auth/callback`;
    const params = new URLSearchParams({
      client_id: client_id as string,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read write follow',
      state: state
    });

    const authUrl = `https://${instance}/oauth/authorize?${params.toString()}`;
    res.json({ url: authUrl });
  });

  // 3. Callback Handler
  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code, state } = req.query;
    const savedState = oauthStates[state as string];

    if (!savedState || !code) {
      return res.status(400).send('Invalid state or code');
    }

    const { instance } = savedState;
    const { client_id, client_secret } = appRegistry[instance];
    const redirectUri = `${process.env.APP_URL || `http://localhost:${PORT}`}/auth/callback`;

    try {
      const response = await axios.post(`https://${instance}/oauth/token`, {
        client_id,
        client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code: code as string
      });

      const { access_token } = response.data;

      // Store in secure cookie
      res.cookie('m_token', access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      res.cookie('m_instance', instance, {
        httpOnly: false,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  instance: '${instance}',
                  token: '${access_token}'
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Token error:', error.response?.data || error.message);
      res.status(500).send('Failed to exchange code for token');
    }
  });

  // Specialized route for updating credentials (profile) to handle multipart/form-data (files)
  app.patch('/api/mastodon/v1/accounts/update_credentials', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'header', maxCount: 1 }]), async (req, res) => {
    const token = req.cookies.m_token;
    const instance = req.cookies.m_instance;

    if (!token || !instance) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    try {
      const formData = new FormData();
      
      // Add text fields
      if (req.body.display_name) formData.append('display_name', req.body.display_name);
      if (req.body.note) formData.append('note', req.body.note);
      if (req.body.locked !== undefined) formData.append('locked', req.body.locked);
      if (req.body.bot !== undefined) formData.append('bot', req.body.bot);
      if (req.body.discoverable !== undefined) formData.append('discoverable', req.body.discoverable);

      // Add files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files?.avatar?.[0]) {
        const blob = new Blob([files.avatar[0].buffer], { type: files.avatar[0].mimetype });
        formData.append('avatar', blob, files.avatar[0].originalname);
      }
      if (files?.header?.[0]) {
        const blob = new Blob([files.header[0].buffer], { type: files.header[0].mimetype });
        formData.append('header', blob, files.header[0].originalname);
      }

      const response = await axios.patch(`https://${instance}/api/v1/accounts/update_credentials`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Mastodon update_credentials error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Update Credentials Error' });
    }
  });

  // 4. API Proxy for Authenticated Requests
  app.all('/api/mastodon/*', async (req, res) => {
    const token = req.cookies.m_token;
    const instance = req.cookies.m_instance;

    if (!token || !instance) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const mastodonPath = req.params[0];
    const url = `https://${instance}/api/${mastodonPath}`;
    
    // Explicitly merge query params to avoid issues with some instances
    const queryParams = { ...req.query };

    try {
      const response = await axios({
        method: req.method,
        url: url,
        data: req.method !== 'GET' ? req.body : undefined,
        params: queryParams,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(req.method !== 'GET' && { 'Content-Type': 'application/json' })
        }
      });
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error(`Mastodon API error at ${url}:`, errorData || error.message);
      res.status(error.response?.status || 500).json(errorData || { error: 'API Error' });
    }
  });

  // 5. Logout (redundant, keeping consistent)
  app.post('/api/auth/logout_full', (req, res) => {
    res.clearCookie('m_token', { sameSite: 'none', secure: true });
    res.clearCookie('m_instance', { sameSite: 'none', secure: true });
    res.json({ success: true });
  });

  // 6. Check Auth Status
  app.get('/api/auth/status', (req, res) => {
    const token = req.cookies.m_token;
    const instance = req.cookies.m_instance;
    res.json({ authenticated: !!token, instance });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
