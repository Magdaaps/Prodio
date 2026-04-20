import axios from 'axios';

const klientApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

klientApi.interceptors.response.use(
  (odpowiedz) => odpowiedz,
  async (blad) => {
    const oryginalneZadanie = blad.config;
    if (blad.response?.status === 401 && !oryginalneZadanie._ponowiona) {
      oryginalneZadanie._ponowiona = true;
      try {
        await axios.post('/api/autentykacja/odswiez', {}, { withCredentials: true });
        return klientApi(oryginalneZadanie);
      } catch {
        if (window.location.pathname !== '/logowanie') {
          window.location.href = '/logowanie';
        }
      }
    }
    return Promise.reject(blad);
  }
);

export default klientApi;
