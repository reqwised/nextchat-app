'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, LogOut, Users, Search, Menu, X, Paperclip, FileText, Download, Image as ImageIcon, Video, File, Plus, UserPlus, MessageSquarePlus } from 'lucide-react';
import PusherClient from 'pusher-js';

interface User {
  id: string;
  name: string;
  role: number;
}

interface Message {
  id: number;
  type: string;
  message: string;
  sender: string;
  sender_name?: string;
  created_at?: string;
  media_url?: string;
  media_type?: string;
  file_name?: string;
  file_size?: number;
}

interface Room {
  id: number;
  name: string;
  image_url: string;
  room_type?: string;
  participants: User[];
  last_message?: string;
  last_message_time?: string;
}

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check authentication
  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      router.push('/');
      return;
    }
    
    try {
      const user = JSON.parse(userStr);
      setCurrentUser(user);
      loadRooms(user.id);
      loadAllUsers(user.id);
    } catch (err) {
      console.error('Error parsing user data:', err);
      localStorage.removeItem('currentUser');
      router.push('/');
    }
  }, []);

  // Load rooms
  const loadRooms = async (userId: string) => {
    try {
      const res = await fetch('/api/rooms', {
        headers: { 'x-user-id': userId }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setRooms(data.rooms || []);
      
      // Auto-select first room
      if (data.rooms && data.rooms.length > 0) {
        selectRoom(data.rooms[0], userId);
      }
    } catch (err) {
      console.error('Error loading rooms:', err);
      alert('Gagal memuat daftar chat. Silakan refresh halaman.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load all users
  const loadAllUsers = async (userId: string) => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'x-user-id': userId }
      });
      
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  // Select room and load messages
  const selectRoom = async (room: Room, userId?: string) => {
    setSelectedRoom(room);
    setIsSidebarOpen(false);
    
    const uid = userId || currentUser?.id;
    if (!uid) return;

    try {
      const res = await fetch(`/api/messages/${room.id}`, {
        headers: { 'x-user-id': uid }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setMessages(data.messages || []);
      console.log('Loaded messages:', data.messages?.length, 'messages');
    } catch (err) {
      console.error('Error loading messages:', err);
      setMessages([]);
    }
  };

  // Polling: Auto-refresh messages every 3 seconds
  useEffect(() => {
    if (!selectedRoom || !currentUser) return;

    const pollMessages = async () => {
      try {
        const res = await fetch(`/api/messages/${selectedRoom.id}`, {
          headers: { 'x-user-id': currentUser.id }
        });
        
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    // Poll every 3 seconds
    const interval = setInterval(pollMessages, 3000);

    return () => clearInterval(interval);
  }, [selectedRoom, currentUser]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || !currentUser) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          message: messageText,
          type: 'text'
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success && data.message) {
        // Add the new message with server response
        const newMsg: Message = {
          ...data.message,
          sender_name: currentUser.name
        };
        setMessages(prev => [...prev, newMsg]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Gagal mengirim pesan. Silakan coba lagi.');
      setNewMessage(messageText); // Restore message if failed
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom || !currentUser) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file maksimal 10MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Tipe file tidak didukung. Gunakan: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV, atau PDF');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-user-id': currentUser.id
        },
        body: formData
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const uploadData = await uploadRes.json();

      // Send message with media
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          message: uploadData.fileName,
          type: 'media',
          mediaUrl: uploadData.url,
          mediaType: uploadData.fileType,
          fileName: uploadData.fileName,
          fileSize: uploadData.fileSize
        })
      });

      if (!res.ok) {
        throw new Error('Send message failed');
      }

      const data = await res.json();
      
      if (data.success && data.message) {
        const newMsg: Message = {
          ...data.message,
          sender_name: currentUser.name
        };
        console.log('New media message:', newMsg);
        console.log('Has media_url?', !!newMsg.media_url);
        console.log('Media URL:', newMsg.media_url);
        console.log('Media Type:', newMsg.media_type);
        setMessages(prev => [...prev, newMsg]);
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      alert(err.message || 'Gagal mengunggah file. Silakan coba lagi.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderMediaMessage = (msg: Message, isCurrentUser: boolean) => {
    if (!msg.media_url) return null;

    // Image
    if (msg.media_type?.startsWith('image/')) {
      return (
        <div className="max-w-sm">
          <img
            src={msg.media_url}
            alt={msg.file_name || 'Image'}
            className="w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition"
            onClick={() => window.open(msg.media_url, '_blank')}
            onError={(e) => {
              console.error('Image load error:', msg.media_url);
              e.currentTarget.style.display = 'none';
            }}
          />
          {msg.file_name && (
            <p className={`text-xs mt-2 px-2 ${isCurrentUser ? 'text-blue-100' : 'text-gray-600'}`}>
              📷 {msg.file_name}
            </p>
          )}
        </div>
      );
    }

    // Video
    if (msg.media_type?.startsWith('video/')) {
      return (
        <div className="max-w-sm">
          <video
            src={msg.media_url}
            controls
            className="w-full h-auto rounded-lg"
            onError={(e) => {
              console.error('Video load error:', msg.media_url);
            }}
          >
            Your browser does not support the video tag.
          </video>
          {msg.file_name && (
            <p className={`text-xs mt-2 px-2 ${isCurrentUser ? 'text-blue-100' : 'text-gray-600'}`}>
              🎥 {msg.file_name}
            </p>
          )}
        </div>
      );
    }

    // PDF
    if (msg.media_type === 'application/pdf') {
      return (
        <div className={`flex items-center space-x-3 p-3 rounded-lg ${isCurrentUser ? 'bg-blue-600' : 'bg-gray-100'}`}>
          <FileText size={32} className={isCurrentUser ? 'text-white' : 'text-red-500'} />
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm ${isCurrentUser ? 'text-white' : 'text-gray-800'} truncate`}>
              {msg.file_name || 'Document.pdf'}
            </p>
            <p className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-gray-600'}`}>
              PDF • {formatFileSize(msg.file_size)}
            </p>
          </div>
          <a
            href={msg.media_url}
            download={msg.file_name}
            target="_blank"
            rel="noopener noreferrer"
            className={`p-2 rounded-lg transition ${isCurrentUser ? 'hover:bg-blue-700' : 'hover:bg-gray-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={20} className={isCurrentUser ? 'text-white' : 'text-gray-700'} />
          </a>
        </div>
      );
    }

    // Fallback for unknown media type
    return (
      <div className={`flex items-center space-x-3 p-3 rounded-lg ${isCurrentUser ? 'bg-blue-600' : 'bg-gray-100'}`}>
        <File size={32} className={isCurrentUser ? 'text-white' : 'text-gray-500'} />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${isCurrentUser ? 'text-white' : 'text-gray-800'} truncate`}>
            {msg.file_name || 'File'}
          </p>
          <p className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-gray-600'}`}>
            {formatFileSize(msg.file_size)}
          </p>
        </div>
        <a
          href={msg.media_url}
          download={msg.file_name}
          target="_blank"
          rel="noopener noreferrer"
          className={`p-2 rounded-lg transition ${isCurrentUser ? 'hover:bg-blue-700' : 'hover:bg-gray-200'}`}
        >
          <Download size={20} className={isCurrentUser ? 'text-white' : 'text-gray-700'} />
        </a>
      </div>
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    router.push('/');
  };

  // Create direct chat
  const handleCreateDirectChat = async (otherUserId: string) => {
    if (!currentUser) return;
    setIsCreatingChat(true);

    try {
      const res = await fetch('/api/rooms/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ otherUserId })
      });

      if (!res.ok) throw new Error('Failed to create chat');

      const data = await res.json();
      
      if (data.success) {
        // Reload rooms
        await loadRooms(currentUser.id);
        // Select new/existing room
        setSelectedRoom(data.room);
        setShowNewChatModal(false);
      }
    } catch (err) {
      console.error('Error creating direct chat:', err);
      alert('Gagal membuat chat');
    } finally {
      setIsCreatingChat(false);
    }
  };

  // Create group chat
  const handleCreateGroup = async () => {
    if (!currentUser || !groupName.trim() || selectedUsers.length === 0) {
      alert('Nama group dan minimal 1 member diperlukan');
      return;
    }

    setIsCreatingChat(true);

    try {
      const res = await fetch('/api/rooms/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          name: groupName,
          memberIds: selectedUsers
        })
      });

      if (!res.ok) throw new Error('Failed to create group');

      const data = await res.json();
      
      if (data.success) {
        // Reload rooms
        await loadRooms(currentUser.id);
        // Select new room
        setSelectedRoom(data.room);
        setShowNewGroupModal(false);
        setGroupName('');
        setSelectedUsers([]);
      }
    } catch (err) {
      console.error('Error creating group:', err);
      alert('Gagal membuat group');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getRoleColor = (role: number) => {
    switch(role) {
      case 0: return 'bg-red-500';
      case 1: return 'bg-blue-500';
      case 2: return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleName = (role: number) => {
    switch(role) {
      case 0: return 'Admin';
      case 1: return 'Agent';
      case 2: return 'Customer';
      default: return 'User';
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar - Rooms List */}
      <div className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 fixed lg:relative z-30 w-80 bg-white border-r border-gray-200 h-full transition-transform duration-300
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 bg-blue-500 text-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold">Chats</h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden hover:bg-blue-600 p-2 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white text-blue-500 rounded-full flex items-center justify-center font-bold">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{currentUser.name}</p>
                <p className="text-xs opacity-90">{getRoleName(currentUser.role)}</p>
              </div>
              <button
                onClick={handleLogout}
                className="hover:bg-blue-600 p-2 rounded-lg transition"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex space-x-2 mb-3">
              <button
                onClick={() => setShowNewChatModal(true)}
                className="flex-1 flex items-center justify-center space-x-2 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition text-sm"
              >
                <MessageSquarePlus size={18} />
                <span>Chat Baru</span>
              </button>
              <button
                onClick={() => setShowNewGroupModal(true)}
                className="flex-1 flex items-center justify-center space-x-2 bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition text-sm"
              >
                <UserPlus size={18} />
                <span>Group Baru</span>
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Cari chat..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <p>Tidak ada chat tersedia</p>
              </div>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => selectRoom(room)}
                  className={`
                    p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition
                    ${selectedRoom?.id === room.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
                  `}
                >
                  <div className="flex items-start space-x-3">
                    <img
                      src={room.image_url}
                      alt={room.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-800 truncate">{room.name}</h3>
                          {room.room_type === 'group' && (
                            <Users size={14} className="text-gray-500" />
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{room.participants?.length || 0}</span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {room.last_message || 'No messages'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden hover:bg-gray-100 p-2 rounded-lg transition"
                >
                  <Menu size={24} />
                </button>
                <img
                  src={selectedRoom.image_url}
                  alt={selectedRoom.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <h2 className="font-semibold text-gray-800">{selectedRoom.name}</h2>
                  <p className="text-xs text-gray-500">
                    {selectedRoom.participants?.length || 0} participants
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                {selectedRoom.participants?.map((participant) => (
                  <div
                    key={participant.id}
                    className={`w-8 h-8 ${getRoleColor(participant.role)} rounded-full flex items-center justify-center text-white text-xs font-bold`}
                    title={`${participant.name} - ${getRoleName(participant.role)}`}
                  >
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Belum ada pesan</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isCurrentUser = msg.sender === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-xs lg:max-w-md xl:max-w-lg">
                        {!isCurrentUser && (
                          <p className="text-xs text-gray-600 mb-1 px-2">{msg.sender_name}</p>
                        )}
                        <div
                          className={`
                            rounded-2xl overflow-hidden
                            ${isCurrentUser 
                              ? 'bg-blue-500 text-white rounded-br-none' 
                              : 'bg-white text-gray-800 rounded-bl-none shadow'
                            }
                            ${msg.type === 'media' ? '' : 'px-4 py-2'}
                          `}
                        >
                          {msg.type === 'text' && (
                            <p className="break-words">{msg.message}</p>
                          )}
                          {msg.type === 'media' && (
                            <div className="p-2">
                              {renderMediaMessage(msg, isCurrentUser)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              {isUploading && (
                <div className="mb-2 text-sm text-blue-600 flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Mengunggah file...</span>
                </div>
              )}
              <div className="flex space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-gray-100 text-gray-600 p-3 rounded-full hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  title="Upload foto, video, atau PDF (max 10MB)"
                >
                  <Paperclip size={20} />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isUploading ? "Mengunggah file..." : "Ketik pesan..."}
                  disabled={isUploading}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isUploading}
                  className="bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
                >
                  <Send size={20} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Klik ikon <Paperclip className="inline" size={14} /> untuk upload foto, video, atau PDF (max 10MB)
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Users size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-xl">Pilih chat untuk memulai</p>
            </div>
          </div>
        )}
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* New Direct Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold">Chat Baru</h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-gray-600 mb-4">Pilih user untuk memulai chat:</p>
              {allUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Tidak ada user lain</p>
              ) : (
                <div className="space-y-2">
                  {allUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleCreateDirectChat(user.id)}
                      disabled={isCreatingChat}
                      className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition disabled:opacity-50"
                    >
                      <div className={`w-10 h-10 ${getRoleColor(user.role)} rounded-full flex items-center justify-center text-white font-bold`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-500">{getRoleName(user.role)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Group Chat Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold">Group Baru</h2>
              <button
                onClick={() => {
                  setShowNewGroupModal(false);
                  setGroupName('');
                  setSelectedUsers([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Group
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Masukkan nama group"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Anggota ({selectedUsers.length})
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {allUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-4 h-4 text-blue-500"
                      />
                      <div className={`w-10 h-10 ${getRoleColor(user.role)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-500">{getRoleName(user.role)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedUsers.length === 0 || isCreatingChat}
                className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingChat ? 'Membuat...' : 'Buat Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}