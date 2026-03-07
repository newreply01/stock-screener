module.exports = (req, res) => {
  res.status(200).json({ status: 'ok', v13: true, message: 'Minimal function v13 works' });
};
