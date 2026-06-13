import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Success() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id") || "VG-STU-00000";
  const role = searchParams.get("role") || "student";

  const handleDashboard = () => {
    setLocation(`/dashboard/${role}`);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-gray-50/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="shadow-2xl border-0 overflow-hidden rounded-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-secondary to-primary" />
          <CardContent className="p-8 md:p-10 flex flex-col items-center text-center space-y-6">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2"
            >
              <CheckCircle2 className="w-10 h-10" />
            </motion.div>
            
            <h2 className="text-3xl font-bold text-foreground">Account Created Successfully!</h2>
            
            <div className="bg-primary/5 border border-primary/20 w-full p-6 rounded-xl space-y-2">
              <p className="text-sm text-primary/80 font-medium uppercase tracking-wider">Your Permanent ID</p>
              <p className="text-4xl font-mono font-bold tracking-widest text-primary">{id}</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg text-sm font-medium w-full">
              Please save this ID safely! You will need it for all future log-ins.
            </div>

            <Button onClick={handleDashboard} size="lg" className="w-full h-14 text-lg rounded-xl mt-4">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
