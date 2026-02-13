import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import fayeLogo from '@/assets/faye-logo-white.png';

export default function AuthLayout({ title, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-[#59168B] p-3 rounded-lg">
              <img src={fayeLogo} alt="Faye" className="h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
      {message}
    </div>
  );
}
