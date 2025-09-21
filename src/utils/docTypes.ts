export type ProgramDoc = {
  name: string;
  type: "massage" | "facial" | "treatment";
  durationOptions: Array<{ durationMinutes: number; price: number }>;
  currency: string;
  isActive: boolean;
};

export type PackageDoc = {
  name: string;
  description: string;
  packagePrice: number;
  numberOfPeople: number;
  durationMinutes: number;
  currency: string;
  isActive?: boolean;
};

export type BookingDoc = {
  id: string;
  arrivalAt: FirebaseFirestore.Timestamp;
  contact?: { name?: string; email?: string; phone?: string };
  items: Array<{
    personName: string;
    programs: Array<{
      nameSnapshot: string;
      durationSnapshot?: number; // minutes
    }>;
    packages: Array<{
      nameSnapshot: string;
      durationSnapshot?: number; // minutes
    }>;
  }>;
};
