import { Router } from "express";
import { db } from "../db";

const router = Router();

/**
 * GET /recurring/:contract
 * Retourne le paiement récurrent + ses events
 */
router.get("/:contract", async (req, res) => {
  const { contract } = req.params;

  if (!contract || !contract.startsWith("0x")) {
    return res.status(400).json({ error: "Invalid contract address" });
  }

  try {
    // 1️⃣ Récupérer le recurring
    const recurringResult = await db.query(
      `
      select *
      from recurring_payments
      where contract_address = $1
      `,
      [contract.toLowerCase()]
    );

    if (recurringResult.rowCount === 0) {
      return res.status(404).json({ error: "Recurring payment not found" });
    }

    const recurring = recurringResult.rows[0];

    // 2️⃣ Récupérer les events
    const eventsResult = await db.query(
      `
      select *
      from recurring_payment_events
      where contract_address = $1
      order by block_number asc
      `,
      [contract.toLowerCase()]
    );

    return res.json({
      recurring,
      events: eventsResult.rows
    });
  } catch (err) {
    console.error("GET /recurring/:contract error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
