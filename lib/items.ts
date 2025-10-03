import {getApp} from "firebase/app";
import{
    getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, 
    serverTimestamp
} from "firebase/firestore";
import{getStorage, ref, uploadBytes, getDownloadURL, deleteObject} from 
"firebase/storage";

export type ClosetItem = {
    id?: string;
    ownerUid: string;
    category: "tops" | "bottoms" | "shoes" | "accessories" | "other";
    imageUrl: string; // final, background-removed PNG if available
    originalIrl?: string; // original upload (optional)
    tags: string[];
    createdAt: any;
};

const app = getApp();
const db = getFirestore(app); 
const storage = getStorage(app);

export async function createItem(ownerUid: string, data: Omit<ClosetItem,"id"|"createdAt">){
    const col = collection(db, "items");
    const docRef = await addDoc(col, {...data, createdAt: serverTimestamp()});
    return docRef.id;
}

export async function addTag(itemId: string, tag: string){
    const d = doc(db, "items", itemId);

    return updateDoc(d, {tags: (window as any).arrayUnion? (window as any).arrayUnion(tag) : tagsUnionFallback(tag)});

}

function tagsUnionFallback(tag: string){
    return (prev: string[]=[]) => Array.from(new Set([...(prev || []), tag.trim()]));
    
}

export async function removeTag(itemId: string, tag:string) {
    const d = doc(db, "items", itemId);
    return updateDoc(d, {tags: (prev: string[] = []) => (prev || []).filter(t =>t !== tag)});

}

export async function deleteItem(itemId: string, imageUrl?: string, originalUrl?:string){
    const tasks: Promise<any>[] = [];
    if(imageUrl) tasks.push(deleteByUrl(imageUrl));
    if(originalUrl && originalUrl !== imageUrl) tasks.push(deleteByUrl(originalUrl));

    await Promise.allSettled(tasks);
    await deleteDoc(doc(db, "items", itemId));
}

async function deleteByUrl(url: string){
    try {
        const s = getStorage();
        const r = ref(s, url);
        await deleteObject(r);
    } catch(e){
        // ignore if already gone
    }
}

export async function uploadOriginalAsync(localUri: string, ownerUid: string){
    const s = getStorage(app);
    const filename = 'uploads/${ownerUid}/${Date.now().jpg';
    const r = ref(s, filename);

    const res = await fetch(localUri);
    const blob = await res.blob();
    await uploadBytes(r, blob, { contentType: "image/jpeg"});
    const url = await getDownloadURL(r);
    return {url, path:filename};
}