// A tiny error class so controllers can say: throw new HttpError(404, 'Not found')
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details; // optional: e.g. a list of field errors
  }
}
