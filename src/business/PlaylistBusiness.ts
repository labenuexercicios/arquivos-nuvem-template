import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { PlaylistDatabase } from "../database/PlaylistDatabase";
import { CreatePlaylistInputDTO, CreatePlaylistOutputDTO } from "../dtos/playlist/createPlaylist.dto";
import { DeletePlaylistInputDTO, DeletePlaylistOutputDTO } from "../dtos/playlist/deletePlaylist.dto";
import { EditPlaylistInputDTO, EditPlaylistOutputDTO } from "../dtos/playlist/editPlaylist.dto";
import { GetPlaylistsInputDTO, GetPlaylistsOutputDTO } from "../dtos/playlist/getPlaylists.dto";
import { LikeOrDislikePlaylistInputDTO, LikeOrDislikePlaylistOutputDTO } from "../dtos/playlist/likeOrDislikePlaylist.dto";
import { ForbiddenError } from "../errors/ForbiddenError";
import { NotFoundError } from "../errors/NotFoundError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import { LikeDislikeDB, PLAYLIST_LIKE, Playlist } from "../models/Playlist";
import { USER_ROLES } from "../models/User";
import { bucketName, s3 } from "../s3";
import { IdGenerator } from "../services/IdGenerator";
import { TokenManager } from "../services/TokenManager";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestError } from "../errors/BadRequestError";

export class PlaylistBusiness {
  constructor(
    private playlistDatabase: PlaylistDatabase,
    private idGenerator: IdGenerator,
    private tokenManager: TokenManager
  ) { }

  public createPlaylist = async (
    input: CreatePlaylistInputDTO
  ): Promise<CreatePlaylistOutputDTO> => {
    const { name, token, thumbnail } = input

    const payload = this.tokenManager.getPayload(token)

    if (!payload) {
      throw new UnauthorizedError()
    }

    const id = this.idGenerator.generate()
    const thumbnailId = this.idGenerator.generate()

    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Body: thumbnail.buffer,
      Key: thumbnailId,
      ContentType: thumbnail.mimetype
    }))

    const playlist = new Playlist(
      id,
      name,
      0,
      0,
      new Date().toISOString(),
      new Date().toISOString(),
      payload.id,
      payload.name,
      thumbnailId
    )

    const playlistDB = playlist.toDBModel()
    await this.playlistDatabase.insertPlaylist(playlistDB)

    const output: CreatePlaylistOutputDTO = undefined

    return output
  }

  public getPlaylists = async (
    input: GetPlaylistsInputDTO
  ): Promise<GetPlaylistsOutputDTO> => {
    const { token } = input

    const payload = this.tokenManager.getPayload(token)

    if (!payload) {
      throw new UnauthorizedError()
    }

    const playlistsDBwithCreatorName =
      await this.playlistDatabase.getPlaylistsWithCreatorName()

    const playlists = []

    for (let playlistWithCreatorName of playlistsDBwithCreatorName) {
      const playlist = new Playlist(
        playlistWithCreatorName.id,
        playlistWithCreatorName.name,
        playlistWithCreatorName.likes,
        playlistWithCreatorName.dislikes,
        playlistWithCreatorName.created_at,
        playlistWithCreatorName.updated_at,
        playlistWithCreatorName.creator_id,
        playlistWithCreatorName.creator_name,
        playlistWithCreatorName.thumbnail
      )

      const url = await getSignedUrl(s3, new GetObjectCommand({
        Bucket: bucketName,
        Key: playlist.getThumbnail()
      }), { expiresIn: 120 })

      playlist.setThumbnail(url)

      playlists.push(playlist.toBusinessModel())
    }

    const output: GetPlaylistsOutputDTO = playlists

    return output
  }

  public editPlaylist = async (
    input: EditPlaylistInputDTO
  ): Promise<EditPlaylistOutputDTO> => {
    const { name, token, idToEdit, thumbnail } = input

    if (
      name === undefined &&
      thumbnail === undefined
    ) {
      throw new BadRequestError(
        "ambos 'name' e 'thumbnail' ausentes, informe pelo menos um"
      )
    }

    const payload = this.tokenManager.getPayload(token)

    if (!payload) {
      throw new UnauthorizedError()
    }

    const playlistDB = await this.playlistDatabase
      .findPlaylistById(idToEdit)

    if (!playlistDB) {
      throw new NotFoundError("playlist com essa id não existe")
    }

    if (payload.id !== playlistDB.creator_id) {
      throw new ForbiddenError("somente quem criou a playlist pode editá-la")
    }

    const playlist = new Playlist(
      playlistDB.id,
      playlistDB.name,
      playlistDB.likes,
      playlistDB.dislikes,
      playlistDB.created_at,
      playlistDB.updated_at,
      playlistDB.creator_id,
      payload.name,
      playlistDB.thumbnail
    )

    name && playlist.setName(name)
    
    if (thumbnail) {
      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Body: thumbnail.buffer,
        Key: playlist.getThumbnail(),
        ContentType: thumbnail.mimetype
      }))
    }

    const updatedPlaylistDB = playlist.toDBModel()
    await this.playlistDatabase.updatePlaylist(updatedPlaylistDB)

    const output: EditPlaylistOutputDTO = undefined

    return output
  }

  public deletePlaylist = async (
    input: DeletePlaylistInputDTO
  ): Promise<DeletePlaylistOutputDTO> => {
    const { token, idToDelete } = input

    const payload = this.tokenManager.getPayload(token)

    if (!payload) {
      throw new UnauthorizedError()
    }

    const playlistDB = await this.playlistDatabase
      .findPlaylistById(idToDelete)

    if (!playlistDB) {
      throw new NotFoundError("playlist com essa id não existe")
    }

    if (payload.role !== USER_ROLES.ADMIN) {
      if (payload.id !== playlistDB.creator_id) {
        throw new ForbiddenError("somente quem criou a playlist pode editá-la")
      }
    }

    await this.playlistDatabase.deletePlaylistById(idToDelete)

    await s3.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: playlistDB.thumbnail
    }))

    const output: DeletePlaylistOutputDTO = undefined

    return output
  }

  public likeOrDislikePlaylist = async (
    input: LikeOrDislikePlaylistInputDTO
  ): Promise<LikeOrDislikePlaylistOutputDTO> => {
    const { token, like, playlistId } = input

    const payload = this.tokenManager.getPayload(token)

    if (!payload) {
      throw new UnauthorizedError()
    }

    const playlistDBWithCreatorName =
      await this.playlistDatabase.findPlaylistWithCreatorNameById(playlistId)

    if (!playlistDBWithCreatorName) {
      throw new NotFoundError("playlist com essa id não existe")
    }

    const playlist = new Playlist(
      playlistDBWithCreatorName.id,
      playlistDBWithCreatorName.name,
      playlistDBWithCreatorName.likes,
      playlistDBWithCreatorName.dislikes,
      playlistDBWithCreatorName.created_at,
      playlistDBWithCreatorName.updated_at,
      playlistDBWithCreatorName.creator_id,
      playlistDBWithCreatorName.creator_name,
      playlistDBWithCreatorName.thumbnail
    )

    const likeSQlite = like ? 1 : 0

    const likeDislikeDB: LikeDislikeDB = {
      user_id: payload.id,
      playlist_id: playlistId,
      like: likeSQlite
    }

    const likeDislikeExists =
      await this.playlistDatabase.findLikeDislike(likeDislikeDB)

    if (likeDislikeExists === PLAYLIST_LIKE.ALREADY_LIKED) {
      if (like) {
        await this.playlistDatabase.removeLikeDislike(likeDislikeDB)
        playlist.removeLike()
      } else {
        await this.playlistDatabase.updateLikeDislike(likeDislikeDB)
        playlist.removeLike()
        playlist.addDislike()
      }

    } else if (likeDislikeExists === PLAYLIST_LIKE.ALREADY_DISLIKED) {
      if (like === false) {
        await this.playlistDatabase.removeLikeDislike(likeDislikeDB)
        playlist.removeDislike()
      } else {
        await this.playlistDatabase.updateLikeDislike(likeDislikeDB)
        playlist.removeDislike()
        playlist.addLike()
      }

    } else {
      await this.playlistDatabase.insertLikeDislike(likeDislikeDB)
      like ? playlist.addLike() : playlist.addDislike()
    }

    const updatedPlaylistDB = playlist.toDBModel()
    await this.playlistDatabase.updatePlaylist(updatedPlaylistDB)

    const output: LikeOrDislikePlaylistOutputDTO = undefined

    return output
  }
}
