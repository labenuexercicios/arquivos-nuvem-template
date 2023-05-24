import z from 'zod'

export interface CreatePlaylistInputDTO {
  name: string,
  token: string,
  thumbnail: Express.Multer.File
}

export type CreatePlaylistOutputDTO = undefined

export const CreatePlaylistSchema = z.object({
  name: z.string().min(1),
  token: z.string().min(1),
  thumbnail: z.custom<Express.Multer.File>()
}).transform(data => data as CreatePlaylistInputDTO)