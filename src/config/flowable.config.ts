import { registerAs } from '@nestjs/config';

export default registerAs('flowable', () => ({
  url: process.env.FLOWABLE_BASE_URL,
  username: process.env.FLOWABLE_USERNAME,
  password: process.env.FLOWABLE_PASSWORD,
  timeout: 15000,
}));
