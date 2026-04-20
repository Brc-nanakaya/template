const prisma = require('../config/db');

exports.list = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { email, name } = req.body;
    const user = await prisma.user.create({ data: { email, name } });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};
