import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Add member
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { memberId } = await request.json();
    const { roomId } = await context.params;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is participant
    const isParticipant = await sql`
      SELECT 1 FROM room_participants 
      WHERE room_id = ${roomId} AND user_id = ${userId}
    `;

    if (isParticipant.length === 0) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Check if room is group
    const room = await sql`
      SELECT room_type FROM rooms WHERE id = ${roomId}
    `;

    if (room.length === 0 || room[0].room_type !== 'group') {
      return NextResponse.json(
        { error: 'Can only add members to group chats' },
        { status: 400 }
      );
    }

    // Check if member already exists
    const exists = await sql`
      SELECT 1 FROM room_participants 
      WHERE room_id = ${roomId} AND user_id = ${memberId}
    `;

    if (exists.length > 0) {
      return NextResponse.json(
        { error: 'User already in group' },
        { status: 400 }
      );
    }

    // Add member
    await sql`
      INSERT INTO room_participants (room_id, user_id)
      VALUES (${roomId}, ${memberId})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Remove member
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');
    const { roomId } = await context.params;

    if (!userId || !memberId) {
      return NextResponse.json(
        { error: 'Missing parameters' },
        { status: 400 }
      );
    }

    // Check if user is participant
    const isParticipant = await sql`
      SELECT 1 FROM room_participants 
      WHERE room_id = ${roomId} AND user_id = ${userId}
    `;

    if (isParticipant.length === 0) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Remove member
    await sql`
      DELETE FROM room_participants 
      WHERE room_id = ${roomId} AND user_id = ${memberId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}