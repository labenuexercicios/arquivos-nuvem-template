import z from 'zod'

export interface EditPlaylistInputDTO {
  name?: string,
  token: string,
  idToEdit: string,
  thumbnail?: Express.Multer.File
}

export type EditPlaylistOutputDTO = undefined

export const EditPlaylistSchema = z.object({
  name: z.string().min(1).optional(),
  token: z.string().min(1),
  idToEdit: z.string().min(1),
  thumbnail: z.custom<Express.Multer.File>().optional()
}).transform(data => data as EditPlaylistInputDTO)