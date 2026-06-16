export {};

declare global {
  namespace Express {
    interface Request {
      vidyaId?: string;
    }
  }
}
