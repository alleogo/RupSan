const express = require("express");
const router = express.Router();
const { addTicket, getYatraTickets, updateTicket, deleteTicket } = require("../controllers/ticket");
const { auth, isManager } = require("../middlewares/auth");
router.post("/add", auth, isManager, addTicket);

router.get("/:yatraId", auth, isManager, getYatraTickets);

router.put("/:id", auth, isManager, updateTicket);

router.delete("/:id", auth, isManager, deleteTicket);

module.exports = router;
