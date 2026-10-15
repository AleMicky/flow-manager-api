export interface FormValidationResult {
  valid: boolean;
  errors: {
    field: string;
    message: string;
    keyword: string;
  }[];
}
