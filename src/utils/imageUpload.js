// Shrinks a phone photo before upload (most are 3–8 MB): max 1600 px, JPEG.
// Falls back to the original file if the browser can't decode it.
export async function compressImage(file, { maxSize = 1600, quality = 0.8 } = {}) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

/** Uploads one photo for the resident app and returns its id. */
export async function uploadPhoto(client, file) {
  const form = new FormData()
  form.append('file', await compressImage(file))
  const { id } = await client.upload('/resident/uploads', form)
  return id
}
