import { IMGBB_API_KEY } from './imgbbConfig';

export const uploadToImgBB = async (base64Image: string): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('image', base64Image);
    formData.append('key', IMGBB_API_KEY);

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Imagen subida a ImgBB');
      return data.data.url;  // URL de la imagen
    } else {
      console.error('❌ Error ImgBB:', data.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error subiendo a ImgBB:', error);
    return null;
  }
};