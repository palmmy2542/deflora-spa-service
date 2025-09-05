import type { Request, Response, NextFunction } from "express";
import { authAdmin } from "../config/firebase.js";

// Expect Authorization: Bearer <Firebase_ID_Token>
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const decoded = await authAdmin.verifyIdToken(token);
    (req as any).user = decoded; // contains uid, email, and custom claims
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

type Role = "admin" | "staff" | "viewer";

export function requireRole(roles: Role[]) {
  return (req: any, res: any, next: any) => {
    const claims = req.user ?? {};
    const role: Role | undefined = claims.role;
    // if (!role || !roles.includes(role)) {
    //   return res.status(403).json({ error: "Forbidden" });
    // }
    next();
  };
}
