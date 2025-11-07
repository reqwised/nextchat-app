import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import pusher from '@/lib/pusher-server';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();
    const { roomId, message, type = 'text', mediaUrl, mediaType, fileName, fileSize } = body;

    console.log('Send message request:', { userId, roomId, type, mediaUrl, fileName });

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is participant
    const participant = await sql`
      SELECT 1 FROM room_participants 
      WHERE room_id = ${roomId} AND user_id = ${userId}
    `;

    if (participant.length === 0) {
      return NextResponse.json(
        { error: 'Not a participant' },
        { status: 403 }
      );
    }

    // Insert message
    const result = await sql`
      INSERT INTO messages (room_id, sender_id, type, message, media_url, media_type, file_name, file_size)
      VALUES (
        ${roomId}, 
        ${userId}, 
        ${type}, 
        ${message || ''}, 
        ${mediaUrl || null}, 
        ${mediaType || null}, 
        ${fileName || null}, 
        ${fileSize || null}
      )
      RETURNING 
        id, 
        type, 
        message, 
        sender_id as sender, 
        created_at,
        media_url,
        media_type,
        file_name,
        file_size
    `;

    const savedMessage = result[0];
    console.log('Message saved to DB:', savedMessage);

    return NextResponse.json({ 
      success: true,
      message: savedMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}