import { PlaylistModel } from "../types"

export interface GetPlaylistsInputDTO {
  token: string | undefined
}

export type GetPlaylistsOutputDTO = PlaylistModel[]

export interface CreatePlaylistInputDTO {
  token: string | undefined,
  name: unknown,
  thumbnail: Express.Multer.File | undefined
}

export interface CreatePlaylistOutputDTO {
playlist: PlaylistModel
}

export interface EditPlaylistInputDTO {
  idToEdit: string,
  token: string | undefined,
  name: unknown
}

export interface DeletePlaylistInputDTO {
  idToDelete: string,
  token: string | undefined
}

export interface LikeOrDislikePlaylistInputDTO {
  idToLikeOrDislike: string,
  token: string | undefined,
  like: unknown
}