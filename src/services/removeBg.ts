export const removeBgFromImage = async (imageUri: string): Promise<string> => {
  const apiKey = "vgi2gHpspTRJKpGmpb9dzCJ7";
  const formData = new FormData();
  formData.append("image_file", {
    uri: imageUri,
    type: "image/jpeg",
    name: "photo.jpg",
  } as any);
  formData.append("size", "auto");
  formData.append("format", "png");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`remove.bg failed [${response.status}]: ${text}`);
  }

  // Convert ArrayBuffer to base64 without Buffer
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:image/png;base64,${base64}`;
};
