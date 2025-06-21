import React, { forwardRef } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { ButtonLoading } from './Loading';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  rounded?: boolean;
  motionProps?: MotionProps;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      rounded = false,
      motionProps,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = [
      'inline-flex items-center justify-center font-medium transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
    ];

    const variantClasses = {
      primary: [
        'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        'shadow-sm hover:shadow-md',
      ],
      secondary: [
        'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
        'shadow-sm hover:shadow-md',
      ],
      outline: [
        'bg-transparent border-2 border-blue-600 text-blue-600',
        'hover:bg-blue-600 hover:text-white focus:ring-blue-500',
      ],
      ghost: [
        'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
      ],
      danger: [
        'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        'shadow-sm hover:shadow-md',
      ],
    };

    const sizeClasses = {
      xs: 'px-2 py-1 text-xs',
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const roundedClasses = {
      xs: rounded ? 'rounded-full' : 'rounded',
      sm: rounded ? 'rounded-full' : 'rounded',
      md: rounded ? 'rounded-full' : 'rounded-md',
      lg: rounded ? 'rounded-full' : 'rounded-lg',
    };

    const classes = [
      ...baseClasses,
      ...variantClasses[variant],
      sizeClasses[size],
      roundedClasses[size],
      fullWidth ? 'w-full' : '',
      className,
    ].join(' ');

    const isDisabled = disabled || loading;

    const buttonContent = (
      <>
        {loading && (
          <ButtonLoading size={size === 'xs' || size === 'sm' ? 'sm' : 'sm'} />
        )}
        
        {!loading && icon && iconPosition === 'left' && (
          <span className={children ? 'mr-2' : ''}>{icon}</span>
        )}
        
        {!loading && children}
        
        {!loading && icon && iconPosition === 'right' && (
          <span className={children ? 'ml-2' : ''}>{icon}</span>
        )}
      </>
    );

    const defaultMotionProps: MotionProps = {
      whileHover: isDisabled ? {} : { scale: 1.02 },
      whileTap: isDisabled ? {} : { scale: 0.98 },
      transition: { duration: 0.2 },
    };

    const combinedMotionProps = {
      ...defaultMotionProps,
      ...motionProps,
    };

    return (
      <motion.button
        ref={ref}
        className={classes}
        disabled={isDisabled}
        {...combinedMotionProps}
        {...(props as any)}
      >
        {buttonContent}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

// プリセットボタンコンポーネント
export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="secondary" {...props} />
);

export const OutlineButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="outline" {...props} />
);

export const GhostButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="ghost" {...props} />
);

export const DangerButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="danger" {...props} />
);

// アイコンボタン
export const IconButton: React.FC<ButtonProps> = ({ children, size = 'md', rounded = true, ...props }) => (
  <Button size={size} rounded={rounded} {...props}>
    {children}
  </Button>
);

// フローティングアクションボタン
export const FloatingActionButton: React.FC<ButtonProps> = ({
  size = 'lg',
  rounded = true,
  className = '',
  ...props
}) => (
  <Button
    size={size}
    rounded={rounded}
    className={`fixed bottom-6 right-6 shadow-lg hover:shadow-xl z-40 ${className}`}
    {...props}
  />
);

// チャット送信ボタン
export const ChatSendButton: React.FC<Omit<ButtonProps, 'variant' | 'size' | 'icon'>> = ({
  disabled,
  loading,
  ...props
}) => (
  <Button
    variant="primary"
    size="md"
    rounded
    disabled={disabled}
    loading={loading}
    icon={
      !loading && (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      )
    }
    {...props}
  />
);

// エスカレーションボタン
export const EscalationButton: React.FC<Omit<ButtonProps, 'variant' | 'icon'>> = (props) => (
  <Button
    variant="outline"
    icon={
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    }
    {...props}
  >
    有人サポート
  </Button>
);

// クイックリプライボタン
export const QuickReplyButton: React.FC<{
  text: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ text, onClick, disabled = false }) => (
  <motion.button
    className="inline-block px-4 py-2 m-1 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    onClick={onClick}
    disabled={disabled}
    whileHover={disabled ? {} : { scale: 1.05 }}
    whileTap={disabled ? {} : { scale: 0.95 }}
    transition={{ duration: 0.2 }}
  >
    {text}
  </motion.button>
);