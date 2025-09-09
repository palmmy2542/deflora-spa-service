export type ProgramDoc = {
  name: string;
  durationOptions: Array<{ durationMinutes: number; price: number }>;
  currency: string;
  isActive: boolean;
};

export type PackageDoc = {
  name: string;
  description: string;
  originalPrice: number;
  packagePrice: number;
  numberOfPeople: number;
  durationMinutes: number;
  currency: string;
  isActive?: boolean;
};
