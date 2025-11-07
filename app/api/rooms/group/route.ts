import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const { name, imageUrl, memberIds } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name required' },
        { status: 400 }
      );
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one member required' },
        { status: 400 }
      );
    }

    // Create new group room
    const defaultImage = imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
    
    const newRoom = await sql`
      INSERT INTO rooms (name, image_url, room_type)
      VALUES (${name.trim()}, ${defaultImage}, 'group')
      RETURNING id, name, image_url, room_type
    `;

    const roomId = newRoom[0].id;

    // Add creator as participant
    const allMemberIds = [userId, ...memberIds.filter(id => id !== userId)];

    // Add all members as participants
    for (const memberId of allMemberIds) {
      await sql`
        INSERT INTO room_participants (room_id, user_id)
        VALUES (${roomId}, ${memberId})
      `;
    }

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
      }
    });
  } catch (error) {
    console.error('Create group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}