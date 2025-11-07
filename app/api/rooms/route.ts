import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all rooms for the user
    const rooms = await sql`
      SELECT 
        r.id,
        r.name,
        r.image_url,
        r.room_type,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'role', u.role
            )
          )
          FROM room_participants rp2
          JOIN users u ON rp2.user_id = u.id
          WHERE rp2.room_id = r.id
        ) as participants,
        (
          SELECT message 
          FROM messages 
          WHERE room_id = r.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT created_at 
          FROM messages 
          WHERE room_id = r.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message_time
      FROM rooms r
      JOIN room_participants rp ON r.id = rp.room_id
      WHERE rp.user_id = ${userId}
      GROUP BY r.id, r.name, r.image_url, r.room_type
      ORDER BY last_message_time DESC NULLS LAST
    `;

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}