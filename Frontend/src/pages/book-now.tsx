import { Redirect } from "wouter";

/**
 * Promo / legacy book routes share the simplified Schedule Pickup flow.
 * Garment and package selection happens with the agent at the door.
 */
export default function BookNow() {
  return <Redirect to="/schedule-pickup" />;
}
