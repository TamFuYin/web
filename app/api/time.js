export default function handler(req, res) {
  res.status(200).json({ time: new Date().toLocaleString("zh-CN") });
}
