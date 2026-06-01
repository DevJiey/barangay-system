const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const result = await db.query('select now() as database_time');
    res.json({
      status: 'ok',
      database: 'connected',
      databaseTime: result.rows[0].database_time,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'not connected',
      message: error.message,
    });
  }
});

router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      'select id, firstname, lastname, username, email, role from users order by id desc',
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get resident count quickly
router.get('/residents-count', async (req, res) => {
  try {
    const result = await db.query('select count(*) as total from residents');
    res.json({ total: parseInt(result.rows[0].total, 10) });
  } catch (error) {
    console.error('Residents Count Error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post('/users', async (req, res) => {
  const { firstname, lastname, username, email, password, role = 'resident' } = req.body;

  if (!firstname || !lastname || !email || !password) {
    return res.status(400).json({ message: 'firstname, lastname, email, and password are required' });
  }

  try {
    const passwordHash = hashPassword(password);
    const result = await db.query(
      `insert into users (firstname, lastname, username, email, password, role)
       values ($1, $2, $3, $4, $5, $6)
       returning id, firstname, lastname, username, email, role, created_at`,
      [firstname, lastname, normalizeUsername(username), email, passwordHash, role],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/register', async (req, res) => {
  const {
    firstname,
    lastname,
    username,
    email,
    password,
    house_no,
    street,
    birthdate,
    gender,
    contact_no,
    occupation,
    civil_status,
  } = req.body;

  if (!firstname || !lastname || !username || !email || !password) {
    return res.status(400).json({ message: 'firstname, lastname, username, email, and password are required' });
  }

  try {
    const passwordHash = hashPassword(password);
    const userResult = await db.query(
      `insert into users (firstname, lastname, username, email, password, role)
       values ($1, $2, $3, $4, $5, 'resident')
       returning id, firstname, lastname, username, email, role, created_at`,
      [firstname, lastname, normalizeUsername(username), email, passwordHash],
    );
    const user = userResult.rows[0];

    const residentResult = await db.query(
      `insert into residents
        (user_id, house_no, street, birthdate, gender, contact_no, occupation, civil_status)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [user.id, house_no, street, birthdate || null, gender, contact_no, occupation, civil_status],
    );

    res.status(201).json({ ...user, resident: residentResult.rows[0] });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, username, identifier, password } = req.body;
  const login = identifier || email || username;

  if (!login || !password) {
    return res.status(400).json({ message: 'email/username and password are required' });
  }

  try {
    const result = await db.query(
      'select * from users where lower(email) = lower($1) or lower(username) = lower($1) limit 1',
      [login],
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const residentResult = await db.query('select * from residents where user_id = $1 limit 1', [user.id]);

    res.json({
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
      email: user.email,
      role: user.role,
      resident: residentResult.rows[0] || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/residents', async (req, res) => {
  try {
    const result = await db.query(
      `select
        residents.*,
        users.firstname,
        users.lastname,
        users.email
       from residents
       left join users on users.id = residents.user_id
       order by residents.id desc`,
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/residents', async (req, res) => {
  const {
    user_id,
    house_no,
    street,
    birthdate,
    gender,
    contact_no,
    occupation,
    civil_status,
  } = req.body;

  try {
    const result = await db.query(
      `insert into residents
        (user_id, house_no, street, birthdate, gender, contact_no, occupation, civil_status)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [user_id || null, house_no, street, birthdate || null, gender, contact_no, occupation, civil_status],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const result = await db.query('select * from announcements order by id desc');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/announcements', async (req, res) => {
  const { title, content, image, created_by } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'title is required' });
  }

  try {
    const result = await db.query(
      `insert into announcements (title, content, image, created_by)
       values ($1, $2, $3, $4)
       returning *`,
      [title, content, image || null, created_by || null],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/document-requests', async (req, res) => {
  try {
    const { resident_id } = req.query;
    const result = resident_id
      ? await db.query('select * from document_requests where resident_id = $1 order by id desc', [resident_id])
      : await db.query('select * from document_requests order by id desc');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/document-requests', async (req, res) => {
  const { resident_id, document_type, purpose, status = 'Pending' } = req.body;

  if (!document_type) {
    return res.status(400).json({ message: 'document_type is required' });
  }

  try {
    const result = await db.query(
      `insert into document_requests (resident_id, document_type, purpose, status)
       values ($1, $2, $3, $4)
       returning *`,
      [resident_id || null, document_type, purpose, status],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/document-requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'status is required' });
  }

  try {
    const result = await db.query(
      `update document_requests
       set status = $1
       where id = $2
       returning *`,
      [status, id],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Document request not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/incident-reports', async (req, res) => {
  try {
    const { resident_id } = req.query;
    const result = resident_id
      ? await db.query('select * from incident_reports where resident_id = $1 order by id desc', [resident_id])
      : await db.query('select * from incident_reports order by id desc');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/incident-reports', async (req, res) => {
  const {
    resident_id,
    incident_type,
    description,
    location,
    photo,
    status = 'Pending',
  } = req.body;

  if (!incident_type) {
    return res.status(400).json({ message: 'incident_type is required' });
  }

  try {
    const result = await db.query(
      `insert into incident_reports
        (resident_id, incident_type, description, location, photo, status)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [resident_id || null, incident_type, description, location, photo || null, status],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/incident-reports/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'status is required' });
  }

  try {
    const result = await db.query(
      `update incident_reports
       set status = $1
       where id = $2
       returning *`,
      [status, id],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Incident report not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/officials', async (req, res) => {
  try {
    const result = await db.query('select * from officials order by id desc');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/households', async (req, res) => {
  try {
    const result = await db.query('select * from households order by id desc');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function normalizeUsername(username) {
  return username?.trim().toLowerCase() || null;
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword?.startsWith('scrypt:')) {
    return password === storedPassword;
  }

  const [, salt, storedHash] = storedPassword.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

module.exports = router;

