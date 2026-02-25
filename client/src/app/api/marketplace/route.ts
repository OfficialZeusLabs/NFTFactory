import { NextRequest, NextResponse } from 'next/server';

// This is a proxy route to connect to our backend server
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const contractAddress = searchParams.get('contractAddress');
  
  try {
    // Construct the backend API URL
    let backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:8000'}/v1/marketplace`;
    
    if (path) {
      backendUrl += `/${path}`;
      
      // Add contract address if present
      if (contractAddress) {
        backendUrl += `/${contractAddress}`;
        // Add stats path if we're accessing a specific contract's stats
        if (path.includes('collections') && path.endsWith('stats')) {
          backendUrl += '/stats';
        }
      }
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
    console.error('Error fetching marketplace data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplace data' }, 
      { status: 500 }
    );
  }
}