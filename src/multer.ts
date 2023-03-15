import multer from "multer"

const storage = multer.memoryStorage()

const multerConfig: multer.Options = {
  storage: storage,

  fileFilter: (req, file, cb) => {
    const validMimes = [
      "text/plain",
      "text/html",
      "text/*",
      "image/jpeg",
      "image/png",
      "image/*",
      "audio/mpeg",
      "audio/ogg",
      "audio/*",
      "video/mp4",
      "video/webm",
      "video/*",
      "application/pdf",
      "application/xml",
      "application/octet-stream" // arquivo binário
      // "etc..."
    ]

    if (validMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Tipo de arquivo inválido"))
    }
  },

  limits: {
    fileSize: 2 * 1024 * 1024 // 2mb
  }
}

export const multerUpload = multer(multerConfig)