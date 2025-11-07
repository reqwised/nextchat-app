import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const { otherUserId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!otherUserId) {
      return NextResponse.json(
        { error: 'Other user ID required' },
        { status: 400 }
      );
    }

    // Check if direct chat already exists
    const existingRoom = await sql`
      SELECT r.id, r.name, r.image_url, r.room_type
      FROM rooms r
      JOIN room_participants rp1 ON r.id = rp1.room_id
      JOIN room_participants rp2 ON r.id = rp2.room_id
      WHERE r.room_type = 'direct'
        AND rp1.user_id = ${userId}
        AND rp2.user_id = ${otherUserId}
      LIMIT 1
    `;

    if (existingRoom.length > 0) {
      // Return existing room
      const participants = await sql`
        SELECT u.id, u.name, u.role
        FROM users u
        JOIN room_participants rp ON u.id = rp.user_id
        WHERE rp.room_id = ${existingRoom[0].id}
      `;

      return NextResponse.json({
        success: true,
        room: {
          ...existingRoom[0],
          participants
        },
        isNew: false
      });
    }

    // Get other user info
    const otherUser = await sql`
      SELECT id, name, role
      FROM users
      WHERE id = ${otherUserId}
    `;

    if (otherUser.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create new direct chat room
    // prepare dulu URL di luar template
    const defaultImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser[0].name)}&background=4F46E5&color=fff`;

    const newRoom = await sql`
    INSERT INTO rooms (name, image_url, room_type)
    VALUES (
        ${otherUser[0].name},
        ${defaultImageUrl},
        'direct'
    )
    RETURNING id, name, image_url, room_type
    `;

    const roomId = newRoom[0].id;

    // Add both users as participants
    await sql`
      INSERT INTO room_participants (room_id, user_id)
      VALUES 
        (${roomId}, ${userId}),
        (${roomId}, ${otherUserId})
    `;

    // Get participants
    const participants = await sql`
      SELECT u.id, u.name, u.role
      FROM users u
      JOIN room_participants rp ON u.id = rp.user_id
      WHERE rp.room_id = ${roomId}
    `;

    return NextResponse.json({
      success: true,
      room: {
        ...newRoom[0],
        participants
      },
      isNew: true
    });
  } catch (error) {
    console.error('Create direct chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}