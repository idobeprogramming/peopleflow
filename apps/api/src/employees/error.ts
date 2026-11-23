export class EmployeeError extends Error {
  constructor(readonly kind: 'invalid' | 'notFound' | 'conflict', message: string) {
    super(message)
  }
}
