import React from 'react';
import {
  User,
  Briefcase,
  AlertTriangle,
  FileText,
  Shield,
  LogOut,
  ChevronRight,
  Globe,
  Trash2,
  CreditCard,
  Smartphone,
  DollarSign,
  Zap,
  Calendar,
  Clock,
  MapPin,
  Navigation,
  Lock,
  Users,
  CheckCircle,
  ArrowLeft,
  Search,
  X,
  Star,
  MessageSquare,
  Crown,
  LucideProps
} from 'lucide-react-native';

export type IconName =
  | 'user'
  | 'briefcase'
  | 'alert-triangle'
  | 'file-text'
  | 'shield'
  | 'logout'
  | 'chevron-right'
  | 'globe'
  | 'trash'
  | 'credit-card'
  | 'smartphone'
  | 'dollar'
  | 'zap'
  | 'calendar'
  | 'clock'
  | 'map-pin'
  | 'navigation'
  | 'lock'
  | 'users'
  | 'check-circle'
  | 'arrow-left'
  | 'search'
  | 'x'
  | 'star'
  | 'message-square'
  | 'crown';

interface IconProps extends LucideProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = '#363636', ...props }: IconProps) {
  switch (name) {
    case 'user':
      return <User size={size} color={color} {...props} />;
    case 'briefcase':
      return <Briefcase size={size} color={color} {...props} />;
    case 'alert-triangle':
      return <AlertTriangle size={size} color={color} {...props} />;
    case 'file-text':
      return <FileText size={size} color={color} {...props} />;
    case 'shield':
      return <Shield size={size} color={color} {...props} />;
    case 'logout':
      return <LogOut size={size} color={color} {...props} />;
    case 'chevron-right':
      return <ChevronRight size={size} color={color} {...props} />;
    case 'globe':
      return <Globe size={size} color={color} {...props} />;
    case 'trash':
      return <Trash2 size={size} color={color} {...props} />;
    case 'credit-card':
      return <CreditCard size={size} color={color} {...props} />;
    case 'smartphone':
      return <Smartphone size={size} color={color} {...props} />;
    case 'dollar':
      return <DollarSign size={size} color={color} {...props} />;
    case 'zap':
      return <Zap size={size} color={color} {...props} />;
    case 'calendar':
      return <Calendar size={size} color={color} {...props} />;
    case 'clock':
      return <Clock size={size} color={color} {...props} />;
    case 'map-pin':
      return <MapPin size={size} color={color} {...props} />;
    case 'navigation':
      return <Navigation size={size} color={color} {...props} />;
    case 'lock':
      return <Lock size={size} color={color} {...props} />;
    case 'users':
      return <Users size={size} color={color} {...props} />;
    case 'check-circle':
      return <CheckCircle size={size} color={color} {...props} />;
    case 'arrow-left':
      return <ArrowLeft size={size} color={color} {...props} />;
    case 'search':
      return <Search size={size} color={color} {...props} />;
    case 'x':
      return <X size={size} color={color} {...props} />;
    case 'star':
      return <Star size={size} color={color} {...props} />;
    case 'message-square':
      return <MessageSquare size={size} color={color} {...props} />;
    case 'crown':
      return <Crown size={size} color={color} {...props} />;
    default:
      return <User size={size} color={color} {...props} />;
  }
}
