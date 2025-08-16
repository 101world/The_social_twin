'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, FolderIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

interface Topic {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  message_count: number;
}

interface ChatTopicSelectorProps {
  selectedTopicId: string | null;
  onTopicSelect: (topicId: string) => void;
  onTopicCreate: (title: string, description?: string) => void;
  onTopicDelete: (topicId: string) => void;
  onTopicUpdate: (topicId: string, title: string, description?: string) => void;
}

export default function ChatTopicSelector({
  selectedTopicId,
  onTopicSelect,
  onTopicCreate,
  onTopicDelete,
  onTopicUpdate
}: ChatTopicSelectorProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      const response = await fetch('/api/topics');
      if (response.ok) {
        const data = await response.json();
        setTopics(data);
      }
    } catch (error) {
      console.error('Error fetching topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!newTitle.trim()) return;
    
    try {
      await onTopicCreate(newTitle.trim(), newDescription.trim() || undefined);
      setNewTitle('');
      setNewDescription('');
      setShowCreateForm(false);
      fetchTopics();
    } catch (error) {
      console.error('Error creating topic:', error);
    }
  };

  const handleUpdateTopic = async (topicId: string) => {
    if (!editTitle.trim()) return;
    
    try {
      await onTopicUpdate(topicId, editTitle.trim(), editDescription.trim() || undefined);
      setEditingTopic(null);
      setEditTitle('');
      setEditDescription('');
      fetchTopics();
    } catch (error) {
      console.error('Error updating topic:', error);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (confirm('Are you sure you want to delete this topic? This action cannot be undone.')) {
      try {
        await onTopicDelete(topicId);
        if (selectedTopicId === topicId) {
          onTopicSelect(topics[0]?.id || '');
        }
        fetchTopics();
      } catch (error) {
        console.error('Error deleting topic:', error);
      }
    }
  };

  const startEditing = (topic: Topic) => {
    setEditingTopic(topic.id);
    setEditTitle(topic.title);
    setEditDescription(topic.description || '');
  };

  const cancelEditing = () => {
    setEditingTopic(null);
    setEditTitle('');
    setEditDescription('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create New Topic Button */}
      <button
        onClick={() => setShowCreateForm(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <PlusIcon className="h-5 w-5" />
        New Topic
      </button>

      {/* Create Topic Form */}
      {showCreateForm && (
        <div className="p-4 bg-gray-50 rounded-lg border">
          <input
            type="text"
            placeholder="Topic title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreateTopic}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Topics List */}
      <div className="space-y-2">
        {topics.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <FolderIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p>No topics yet</p>
            <p className="text-sm">Create your first topic to get started</p>
          </div>
        ) : (
          topics.map((topic) => (
            <div
              key={topic.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedTopicId === topic.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {editingTopic === topic.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={2}
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleUpdateTopic(topic.id)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div onClick={() => onTopicSelect(topic.id)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{topic.title}</h3>
                      {topic.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {topic.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>{topic.message_count} messages</span>
                        <span>{new Date(topic.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(topic);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTopic(topic.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
