import { NextRequest, NextResponse } from 'next/server';

// This is a proxy route to connect to our backend server
export async function GET(request: NextRequest) {
  try {
    // Construct the backend API URL
    const backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:8000'}/v1/marketplace/trending`; 
    
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
    console.error('Error fetching trending collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending collections' }, 
      { status: 500 }
    );
  }
}