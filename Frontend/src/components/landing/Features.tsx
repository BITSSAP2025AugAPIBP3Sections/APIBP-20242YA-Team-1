import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Zap, Shield, TrendingUp, Users, Mail, FolderTree, Database, MessageSquare, FileText } from "lucide-react";

const features = [
  {
    icon: Mail,
    title: "Automated Email Fetching",
    description: "Connect your Gmail and fetch all invoices automatically without manual intervention.",
  },
  {
    icon: FolderTree,
    title: "Smart Organization",
    description: "Invoices are neatly stored in vendor-wise Google Drive folders for easy access.",
  },
  {
    icon: FileText,
    title: "AI-Powered OCR Extraction",
    description: "Extract invoice number, date, amount, and vendor details accurately using advanced AI.",
  },
  {
    icon: Database,
    title: "Google Sheets Integration",
    description: "Maintain structured, actionable data for finance and audit purposes automatically.",
  },
  {
    icon: MessageSquare,
    title: "Analytics & Chatbot Insights",
    description: "Ask natural language questions like 'Total spend with Vendor A this year' and get instant answers.",
  },
  {
    icon: Shield,
    title: "Secure & Role-Based Access",
    description: "Assign owners, accountants, or team members with proper permissions for secure collaboration.",
  },
];
 
export const Features = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { margin: "-100px" });

  return (
    <section ref={ref} id="features" className="py-24 md:py-32">
      <div className="container px-4 md:px-8 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Powerful automation features that handle your invoice management end-to-end with AI precision.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ 
                  duration: 0.8, 
                  delay: index * 0.2,
                  ease: "easeOut"
                }}
                className="group"
              >
                <div className="p-8 rounded-2xl border border-[hsl(var(--feature-card-border))] bg-card hover:bg-[hsl(var(--feature-card-hover))] transition-all duration-300 hover:shadow-lg h-full">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
