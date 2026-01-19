import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { Pool } from "pg";

import FactoryArtifact from "./abi/PaymentFactory_Recurring.json";
import RecurringABI from "./abi/RecurringPaymentERC20.json";

dotenv.config();

// ==============================
// ENV
// ==============================
const WS_RPC_URL = process.env.WS_RPC_URL!;
const FACTORY_ADDRESS = process.env.PAYMENT_CONTRACT!;
const DATABASE_URL = process.env.DATABASE_URL!;

// ==============================
// PROVIDER
// ==============================
const provider = new ethers.WebSocketProvider(WS_RPC_URL);

// ==============================
// DATABASE
// ==============================
const pool = new Pool({
  connectionString: DATABASE_URL
});

// ==============================
// ABIs
// ==============================
const FactoryABI = FactoryArtifact.abi; // artifact Hardhat

// ==============================
// CONTRACT FACTORY
// ==============================
const factory = new ethers.Contract(
  FACTORY_ADDRESS,
  FactoryABI,
  provider
);

console.log("🟢 WS connected");
console.log("👂 Listening factory:", FACTORY_ADDRESS);

// ==============================
// BLOCK LOG
// ==============================
provider.on("block", (blockNumber) => {
  console.log("📦 block:", blockNumber);
});

// ==============================
// FACTORY EVENT
// ==============================
factory.on(
  "RecurringPaymentCreatedERC20",
  async (
    payer: string,
    payee: string,
    tokenAddress: string,
    paymentContract: string,
    monthlyAmount: bigint,
    protocolFeePerMonth: bigint,
    startDate: bigint,
    totalMonths: bigint,
    ev
  ) => {
    console.log("🆕 RecurringPaymentCreatedERC20");
    console.log({
      payer,
      payee,
      tokenAddress,
      paymentContract,
      monthlyAmount: monthlyAmount.toString(),
      protocolFeePerMonth: protocolFeePerMonth.toString(),
      startDate: startDate.toString(),
      totalMonths: totalMonths.toString()
    });

    // Persist main recurring payment
    await pool.query(
      `
      insert into recurring_payments (
        contract_address,
        payer_address,
        payee_address,
        token_address,
        token_symbol,
        network,
        transaction_hash,
        monthly_amount,
        total_months,
        first_payment_time,
        next_execution_time,
        status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,'pending')
      on conflict (contract_address) do nothing
      `,
      [
        paymentContract,
        payer,
        payee,
        tokenAddress,
        "USDC", // ou USDT selon ton frontend
        "base_mainnet",
        ev.log.transactionHash,
        monthlyAmount.toString(),
        Number(totalMonths),
        Number(startDate),
        Number(startDate)
      ]
    );

    attachRecurringListener(paymentContract);
  }
);

// ==============================
// RECURRING LISTENER
// ==============================
function attachRecurringListener(recurringAddress: string) {
  console.log("👂 Attaching RecurringPaymentERC20:", recurringAddress);

  const recurring = new ethers.Contract(
    recurringAddress,
    RecurringABI,
    provider
  );

  // ==============================
  // SUCCESS
  // ==============================
  recurring.on(
    "MonthlyPaymentExecuted",
    async (
      month: bigint,
      payee: string,
      amount: bigint,
      fee: bigint,
      nextPaymentDate: bigint,
      ev
    ) => {
      console.log("✅ MonthlyPaymentExecuted");
      console.log({
        recurringAddress,
        month: month.toString(),
        payee,
        amount: amount.toString(),
        fee: fee.toString(),
        nextPaymentDate: nextPaymentDate.toString()
      });

      const block = await ev.getBlock();

      await pool.query(
        `
        insert into recurring_payment_events (
          contract_address,
          event_type,
          month,
          payee_address,
          amount,
          protocol_fee,
          transaction_hash,
          block_number,
          block_timestamp
        ) values ($1,'EXECUTED',$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          recurringAddress,
          Number(month),
          payee,
          amount.toString(),
          fee.toString(),
          ev.log.transactionHash,
          ev.log.blockNumber,
          block.timestamp
        ]
      );

      await pool.query(
        `
        update recurring_payments
        set
          executed_months = executed_months + 1,
          last_execution_time = $1,
          last_execution_hash = $2,
          next_execution_time = $3,
          status = case
            when executed_months + 1 = total_months then 'completed'
            else 'active'
          end
        where contract_address = $4
        `,
        [
          block.timestamp,
          ev.log.transactionHash,
          Number(nextPaymentDate),
          recurringAddress
        ]
      );
    }
  );

  // ==============================
  // FAILURE (STRICT SKIP)
  // ==============================
  recurring.on(
    "MonthlyPaymentFailed",
    async (
      month: bigint,
      payer: string,
      reason: string,
      ev
    ) => {
      console.log("❌ MonthlyPaymentFailed");
      console.log({
        recurringAddress,
        month: month.toString(),
        payer,
        reason
      });

      const block = await ev.getBlock();

      await pool.query(
        `
        insert into recurring_payment_events (
          contract_address,
          event_type,
          month,
          payer_address,
          reason,
          transaction_hash,
          block_number,
          block_timestamp
        ) values ($1,'FAILED',$2,$3,$4,$5,$6,$7)
        `,
        [
          recurringAddress,
          Number(month),
          payer,
          reason,
          ev.log.transactionHash,
          ev.log.blockNumber,
          block.timestamp
        ]
      );

      // On NE BLOQUE PAS : le prochain paiement pourra passer
      await pool.query(
        `
        update recurring_payments
        set
          last_execution_time = $1,
          status = 'active'
        where contract_address = $2
        `,
        [
          block.timestamp,
          recurringAddress
        ]
      );
    }
  );
}

// ==============================
// CLEAN EXIT
// ==============================
process.on("SIGINT", async () => {
  console.log("🛑 SIGINT: shutting down");
  await pool.end();
  provider.destroy();
  process.exit(0);
});
