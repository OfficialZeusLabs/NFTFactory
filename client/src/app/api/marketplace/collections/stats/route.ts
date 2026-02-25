import { NextRequest, NextResponse } from 'next/server';

// This is a proxy route to connect to our backend server
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  try {
    // Construct the backend API URL
    let backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:8000'}/v1/marketplace/collections/stats`;
    
    // Add contract address if provided
    const contractAddress = searchParams.get('contractAddress');
    if (contractAddress) {
      backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:8000'}/v1/marketplace/collections/${contractAddress}/stats`;
    }
    
    const response = await fetch(backendUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching marketplace collections stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplace collections stats' }, 
      { status: 500 }
    );
  }
}