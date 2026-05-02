from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.db import CurrentUser, FolderRepo
from app.schemas.schemas import FolderCreate, FolderOut, FolderUpdate, TripOut
from app.services.folder_service import (
    FolderNameAlreadyExists,
    FolderNotFound,
    create_folder,
    delete_folder,
    get_folder,
    list_folder_trips,
    list_folders,
    update_folder,
)

router = APIRouter(prefix="/folders", tags=["folders"])


@router.post("/", response_model=FolderOut, status_code=201)
async def create(body: FolderCreate, user: CurrentUser, repo: FolderRepo):
    try:
        return await create_folder(
            repo,
            user.id,
            name=body.name,
            description=body.description,
        )
    except FolderNameAlreadyExists:
        raise HTTPException(400, "Folder name already exists")
    except IntegrityError as exc:
        raise HTTPException(400, "Folder name already exists") from exc


@router.get("/", response_model=list[FolderOut])
async def list_all(user: CurrentUser, repo: FolderRepo):
    return await list_folders(repo, user.id)


@router.get("/{folder_id}", response_model=FolderOut)
async def get_one(folder_id: int, user: CurrentUser, repo: FolderRepo):
    try:
        return await get_folder(repo, user.id, folder_id)
    except FolderNotFound:
        raise HTTPException(404, "Folder not found")


@router.patch("/{folder_id}", response_model=FolderOut)
async def update(
    folder_id: int,
    body: FolderUpdate,
    user: CurrentUser,
    repo: FolderRepo,
):
    try:
        return await update_folder(
            repo,
            user.id,
            folder_id,
            name=body.name,
            description=body.description,
        )
    except FolderNotFound:
        raise HTTPException(404, "Folder not found")
    except FolderNameAlreadyExists:
        raise HTTPException(400, "Folder name already exists")
    except IntegrityError as exc:
        raise HTTPException(400, "Folder name already exists") from exc


@router.get("/{folder_id}/trips", response_model=list[TripOut])
async def list_trips(folder_id: int, user: CurrentUser, repo: FolderRepo):
    try:
        return await list_folder_trips(repo, user.id, folder_id)
    except FolderNotFound:
        raise HTTPException(404, "Folder not found")


@router.delete("/{folder_id}", status_code=204)
async def delete(folder_id: int, user: CurrentUser, repo: FolderRepo):
    try:
        await delete_folder(repo, user.id, folder_id)
    except FolderNotFound:
        raise HTTPException(404, "Folder not found")
