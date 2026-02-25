export interface LaunchPadInterface {
  project: {
    title: string | null;
    description?: string | null;
    category?: string | null;
  } | null;
  team: object | null;
  artworks: {
    price: string | null;
  } | null;
  sales: object | null;
  social: object | null;
  address: string;
  connected: boolean;
}
