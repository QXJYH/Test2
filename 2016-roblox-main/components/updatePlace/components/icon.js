import updatePlaceStore from "../stores/updatePlaceStore";
import { useEffect, useState } from "react";
import { multiGetUniverseIcons } from "../../../services/thumbnails";
import request, { getBaseUrl, getFullUrl } from "../../../lib/request";

const Icon = props => {
  const store = updatePlaceStore.useContainer();
  const [icon, setIcon] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);

  useEffect(() => {
    refreshIcon();
  }, [store.details]);

  const refreshIcon = () => {
    multiGetUniverseIcons({universeIds: [store.details.universeId], size: '420x420'}).then(img => {
      if (img.length && img[0].imageUrl) {
        setIcon(img[0].imageUrl + '?' + new Date().getTime());
      }
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      setError('Only image files are allowed');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('File size must be less than 8MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await request('POST', getFullUrl('develop', `/upload-icon?placeId=${store.details.placeId}`), formData);

      setIcon('https://' + getBaseUrl('bb') + '/img/placeholder.png');
      
      setTimeout(refreshIcon, 1000);
    } catch (err) {
      if (err.response?.headers?.get('x-csrf-token')) {
        setCsrfToken(err.response.headers.get('x-csrf-token'));
        try {
          await request('POST', getFullUrl('develop', `/upload-icon?placeId=${store.details.placeId}`), formData, {
            headers: {
              'x-csrf-token': err.response.headers.get('x-csrf-token')
            }
          });
          setIcon('https://' + getBaseUrl('bb') + '/img/placeholder.png');
          setTimeout(refreshIcon, 1000);
        } catch (retryError) {
          setError(retryError.message || 'Failed to upload image! Does it meet the recommended size/width limits?');
        }
      } else {
        setError(err.message || 'Upload failed');
      }
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className='row mt-4'>
      <div className='col-12'>
        <h2 className='fw-bolder mb-4'>Game Icon</h2>
      </div>
      <div className='col-6'>
        <img 
          className='w-100 mx-auto d-block mb-3' 
          src={icon || '/img/placeholder.png'} 
          alt='Your game icon' 
          style={{maxWidth: '420px', maxHeight: '420px'}}
        />
        
        <div className="d-flex flex-column">
          <label className="btn btn-primary" htmlFor="icon-upload">
            {isUploading ? 'Uploading...' : 'Upload Icon'}
            <input
              id="icon-upload"
              type="file"
              accept="image/png, image/jpeg"
              onChange={handleFileUpload}
              disabled={isUploading}
              style={{display: 'none'}}
            />
          </label>
          
          <small className="text-muted mt-2">
            Recommended: 512×512 PNG or JPG (Square aspect ratio)
          </small>
          
          {error && (
            <div className="alert alert-danger mt-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Icon;