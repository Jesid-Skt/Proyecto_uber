import type { DriverDocumentRecord } from '../models/Driver.js';

export function serializeDriver(driver: DriverDocumentRecord) {
  const documents = driver.documents;
  if (!documents) {
    throw new Error('El perfil no contiene los documentos requeridos.');
  }
  return {
    id: driver.id,
    fullName: driver.fullName,
    email: driver.email,
    idNumber: driver.idNumber,
    phone: driver.phone,
    birthDate: driver.birthDate.toISOString().slice(0, 10),
    gender: driver.gender,
    language: driver.language,
    profilePhotoId: driver.profilePhotoId.toString(),
    vehicle: {
      category: driver.vehicle.category,
      plate: driver.vehicle.plate,
      make: driver.vehicle.make,
      model: driver.vehicle.model,
      year: driver.vehicle.year,
      color: driver.vehicle.color,
      capacity: driver.vehicle.capacity,
      photoId: driver.vehicle.photoId?.toString() ?? '',
    },
    documents: {
      licenseNumber: documents.licenseNumber,
      licenseExpiry: documents.licenseExpiry.toISOString().slice(0, 10),
      licensePhotoId: documents.licensePhotoId.toString(),
      soatExpiry: documents.soatExpiry.toISOString().slice(0, 10),
      soatPhotoId: documents.soatPhotoId.toString(),
      revisionExpiry: documents.revisionExpiry?.toISOString().slice(0, 10) ?? null,
      revisionPhotoId: documents.revisionPhotoId?.toString() ?? null,
      mercadoPagoEmail: documents.mercadoPagoEmail,
      termsAcceptedAt: documents.termsAcceptedAt.toISOString(),
    },
    approvalStatus: driver.approvalStatus,
    available: driver.available,
    createdAt: driver.createdAt.toISOString(),
    updatedAt: driver.updatedAt.toISOString(),
  };
}
