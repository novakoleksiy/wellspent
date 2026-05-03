import { request } from "./client";
import type { FolderCreate, FolderOut, FolderUpdate } from "../types";

export const listFolders = () => request<FolderOut[]>("/api/folders/");

export const createFolder = (body: FolderCreate) =>
    request<FolderOut>("/api/folders/", {
        method: "POST",
        body: JSON.stringify(body),
    });

export const updateFolder = (id: number, body: FolderUpdate) =>
    request<FolderOut>(`/api/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });

export const deleteFolder = (id: number) =>
    request<void>(`/api/folders/${id}`, { method: "DELETE" });
