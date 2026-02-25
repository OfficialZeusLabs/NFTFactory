import axios from 'axios';
import FormData from 'form-data';
import logger from '../utils/logger';

class IPFSService {
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private pinataJWT: string;
  private baseURL: string = 'https://api.pinata.cloud';

  constructor() {
    this.pinataApiKey = process.env.PINATA_API_KEY || '';
    this.pinataSecretKey = process.env.PINATA_SECRET_KEY || '';
    this.pinataJWT = process.env.PINATA_JWT || '';

    if (!this.pinataJWT && (!this.pinataApiKey || !this.pinataSecretKey)) {
      logger.warn('Pinata credentials not configured. IPFS uploads will fail.');
    }
  }

  async uploadImage(buffer: Buffer, filename: string): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', buffer, { filename });

      const headers: Record<string, string> = {
        ...formData.getHeaders(),
      };

      if (this.pinataJWT) {
        headers['Authorization'] = `Bearer ${this.pinataJWT}`;
      } else {
        headers['pinata_api_key'] = this.pinataApiKey;
        headers['pinata_secret_api_key'] = this.pinataSecretKey;
      }

      const response = await axios.post(
        `${this.baseURL}/pinning/pinFileToIPFS`,
        formData,
        { headers }
      );

      if (response.data && response.data.IpfsHash) {
        logger.info(`Image uploaded to IPFS: ${response.data.IpfsHash}`);
        return response.data.IpfsHash;
      }

      return null;
    } catch (error) {
      logger.error('Error uploading image to IPFS:', error);
      return null;
    }
  }

  async uploadMetadata(metadata: object): Promise<string | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.pinataJWT) {
        headers['Authorization'] = `Bearer ${this.pinataJWT}`;
      } else {
        headers['pinata_api_key'] = this.pinataApiKey;
        headers['pinata_secret_api_key'] = this.pinataSecretKey;
      }

      const response = await axios.post(
        `${this.baseURL}/pinning/pinJSONToIPFS`,
        metadata,
        { headers }
      );

      if (response.data && response.data.IpfsHash) {
        logger.info(`Metadata uploaded to IPFS: ${response.data.IpfsHash}`);
        return response.data.IpfsHash;
      }

      return null;
    } catch (error) {
      logger.error('Error uploading metadata to IPFS:', error);
      return null;
    }
  }

  generateMetadata(
    name: string,
    description: string,
    imageCID: string,
    organizationTier: number,
    productClass: number,
    royaltyPercent: number
  ): object {
    const tierNames = ['COAL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
    
    return {
      name,
      description,
      image: `ipfs://${imageCID}`,
      attributes: [
        { trait_type: 'Organization Tier', value: tierNames[organizationTier] || 'UNKNOWN' },
        { trait_type: 'Product Class', value: tierNames[productClass] || 'UNKNOWN' },
        { trait_type: 'Royalty', value: `${royaltyPercent}%` },
      ],
    };
  }

  getIPFSUrl(cid: string): string {
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
}

export default new IPFSService();
