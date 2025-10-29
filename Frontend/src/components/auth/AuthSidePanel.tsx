import React from 'react';
import dashboardImage from '@/assets/dashboard.png';


export const AuthSidePanel = () => {
  return (
   <div className='hidden lg:flex lg:w-1/2'>
        <img src={dashboardImage} alt="Dashboard preview" className="w-full h-auto rounded-3xl"/>
   </div>
  );
};

export default AuthSidePanel;