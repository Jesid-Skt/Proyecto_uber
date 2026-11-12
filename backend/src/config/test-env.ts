// AI-assisted: see docs/AI_LOG.md #4 and #6.
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGODB_URI = 'mongodb://localhost:27017/uber_clone_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-at-least-32-characters';
process.env.TRIP_REQUEST_API_KEY = '';
process.env.GOOGLE_MAPS_SERVER_API_KEY = '';
process.env.ORS_API_KEY = 'test-openrouteservice-key';
process.env.FIREBASE_PROJECT_ID = '';
process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-unit-test-token';
process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'test-only-webhook-secret-that-is-at-least-32-characters';
process.env.BACKEND_PUBLIC_URL = 'https://api.example.test';
process.env.FRONTEND_ORIGINS = 'http://localhost:8081';
