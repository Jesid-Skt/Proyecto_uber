import { Readable } from 'node:stream';
import { GridFSBucket, ObjectId, type Db } from 'mongodb';

export type DriverDocumentKind = 'profile' | 'vehicle' | 'license' | 'soat' | 'revision';

export function createDocumentStorage(database: Db) {
  const bucket = new GridFSBucket(database, { bucketName: 'driverDocuments' });

  return {
    async save(ownerId: ObjectId, kind: DriverDocumentKind, buffer: Buffer, contentType: string) {
      const id = new ObjectId();
      const upload = bucket.openUploadStreamWithId(id, `${kind}.image`, {
        metadata: { ownerId, kind, contentType },
      });
      await new Promise<void>((resolve, reject) => {
        Readable.from(buffer).pipe(upload).on('error', reject).on('finish', resolve);
      });
      return {
        id,
        ownerId,
        kind,
        contentType,
        length: buffer.length,
        uploadDate: new Date(),
      };
    },
    async delete(ids: ObjectId[]) {
      await Promise.all(ids.map(async (id) => {
        try {
          await bucket.delete(id);
        } catch (error) {
          if (!(error instanceof Error && error.message.includes('FileNotFound'))) {
            throw error;
          }
        }
      }));
    },
    openDownload(id: ObjectId) {
      return bucket.openDownloadStream(id);
    },
  };
}
