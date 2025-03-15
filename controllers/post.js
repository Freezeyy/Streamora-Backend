const m = require('../models');
const path = require('path');
const upload = require('../middleware/upload');


async function index(req, res) {
  const includes = [
    { model: m.User, attributes: ['id', 'name', 'image'], as: 'user' }, // Include user data
    { model: m.Media, as: 'media', attributes: ['media_path'] } // Use 'mediaFiles' as alias for media
  ];

  // Optionally include comments
  if (req.query.with && req.query.with.includes('comments')) {
    includes.push({
      model: m.Comment,
      as: 'comments', // Match the alias defined in your Post model
      include: [
        {
          model: m.User,
          as: 'user', // Match the alias defined in your Comment model
          attributes: ['id', 'name'],
        },
      ],
    });
  }

  // Optionally include likes
  if (req.query.with && req.query.with.includes('likes')) {
    includes.push({
      model: m.Like,
      as: 'likes',
      attributes: ['user_id'], // Only return the user_id of users who liked the post
    });
  }

  try {
    const posts = await m.Post.findAll({
      include: includes,
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error });
  }
}



async function create(req, res) {
  try {
    // Log request body and files for debugging
    console.log('Request Body:', req.body);  // Should log the content of the post
    console.log("CONTENT: ", req.body.content);
    
    console.log('Files:', req.files);  // Should log the uploaded files

    const { content } = req.body;

    // Create the post first
    const post = await m.Post.create({
      user_id: req.user.id,  // Ensure req.user is set correctly
      content,
    });

    // Log the created post details
    console.log('Created Post:', post);

    // Check if media files were uploaded
    if (req.files && req.files.length > 0) {
      // Save each media item
      const mediaPaths = req.files.map(file => path.join('/uploads/posts', file.filename));

      // Log the media paths
      console.log('Media Paths:', mediaPaths);

      const mediaPromises = mediaPaths.map(mediaPath => {
        return m.Media.create({
          post_id: post.id,
          media_path: mediaPath,
        });
      });

      await Promise.all(mediaPromises);
    }

    // Optionally fetch and include the media with the post
    const postWithMedia = await m.Post.findByPk(post.id, {
      include: [{ model: m.Media, as: 'media' }],
    });

    // Log the post with media
    console.log('Post with Media:', postWithMedia);

    res.status(201).json(postWithMedia); // Return post with media included
  } catch (error) {
    console.error('Error creating post:', error);  // Log any error
    res.status(500).json({ error: error.message });
  }
}



async function update(req, res) {
  try {
    const { content } = req.body;
    const mediaFiles = req.files ? req.files.map(file => path.join('/uploads/posts', file.filename)) : [];

    const postId = req.params.postId;

    // Find the post by ID
    const post = await m.Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Update the post content
    post.content = content !== undefined ? content : post.content;
    await post.save(); // Save the changes to the post

    // If no media files were uploaded, delete all associated media
    if (mediaFiles.length === 0) {
      await m.Media.destroy({ where: { post_id: postId } });
    } else {
      // If media files are uploaded, delete existing media and insert new media records
      await m.Media.destroy({ where: { post_id: postId } });

      const mediaPromises = mediaFiles.map(mediaPath => {
        return m.Media.create({ post_id: postId, media_path: mediaPath });
      });

      await Promise.all(mediaPromises);
    }

    // Optionally fetch and return the updated post with its media
    const updatedPost = await m.Post.findByPk(postId, {
      include: [{ model: m.Media, as: 'media' }],
    });

    res.status(200).json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the post', details: error.message });
  }
}



async function getDetails(req, res) {
  const { postId } = req.params;
  const includes = [
    { model: m.User, attributes: ['id', 'name', 'image'], as: 'user' },
    { model: m.Media, as: 'media', attributes: ['media_path'] } // Use 'mediaFiles' as alias for media
  ];

  // Check if 'with' query parameter exists and includes 'comments'
  if (req.query.with && req.query.with.includes('comments')) {
    includes.push({
      model: m.Comment,
      as: 'comments',
      include: [
        {
          model: m.User,
          as: 'user',
          attributes: ['id', 'name'],
        },
      ],
    });
  }

  // Check if 'with' query parameter exists and includes 'likes'
  if (req.query.with && req.query.with.includes('likes')) {
    includes.push({
      model: m.Like,
      as: 'likes',
      attributes: ['user_id'],
    });
  }

  try {
    const post = await m.Post.findByPk(postId, {
      include: includes,
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error });
  }
}


module.exports = { index, create, update, getDetails };
